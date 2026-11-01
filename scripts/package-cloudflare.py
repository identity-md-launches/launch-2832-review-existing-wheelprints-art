#!/usr/bin/env python3
"""Create portable Cloudflare and developer ZIPs using only Python's stdlib.

This script builds files locally. It does not authenticate, upload, sign or deploy.
"""

import argparse
import hashlib
import html
from html.parser import HTMLParser
import json
from pathlib import Path, PurePosixPath
import re
import shutil
import sys
import tempfile
from urllib.parse import unquote, urlsplit
import zipfile

ROOT = Path(__file__).resolve().parents[1]
OUTPUT = ROOT / "deliverables"
PROJECT_NAME = "wheelprints-sepolia"
STATIC_NAME = "Wheelprints_Cloudflare_Static.zip"
DEVELOPER_NAME = "Wheelprints_Codex_Handoff.zip"
MAX_FILES = 1000
MAX_ASSET_BYTES = 25 * 1024 * 1024
FORBIDDEN_PARTS = {
    ".git", ".openai", ".agents", ".codex", ".aws", ".wrangler", ".cache",
    "node_modules", "research", "secrets", "credentials", "__pycache__",
}
FORBIDDEN_NAMES = {".env", ".npmrc", ".netrc", ".DS_Store", "id_rsa", "id_ed25519"}
FORBIDDEN_SUFFIXES = {".pem", ".key", ".p12", ".pfx", ".pyc"}
PUBLIC_REQUIRED = (
    "index.html", "testnet/index.html", "testnet/deploy.html",
    "testnet/contract-artifact.json", "testnet/commitments.json",
    "testnet/release-status.json", "testnet/constructor-simulation.json",
    "vendor/ethers.umd.min.js", "data/periods.json", "data/exports.js",
)
DEVELOPER_REQUIRED = (
    "package.json", "package-lock.json", "contracts/WheelprintsSepolia.sol",
    "scripts/build-contracts.cjs", "scripts/contract-toolchain.cjs", "tests/contracts-check.cjs",
    "scripts/package-cloudflare.py", "hosting/README.md", "hosting/wrangler.jsonc",
)
DEVELOPER_DIRS = ("contracts", "scripts", "tests", "hosting", "handoff-evidence")
DEVELOPER_FILES = (
    "README.md", "package.json", "package-lock.json",
    "hardhat.config.cjs", "hardhat.config.js", "hardhat.config.ts", "foundry.toml",
    "LICENSE", "LICENSE.md", "LICENSE.txt",
)


def fail(message):
    raise ValueError(message)


def excluded(relative):
    parts = PurePosixPath(relative).parts
    name = parts[-1] if parts else ""
    return (
        any(part in FORBIDDEN_PARTS for part in parts)
        or name in FORBIDDEN_NAMES
        or name.startswith(".env.")
        or Path(name).suffix.lower() in FORBIDDEN_SUFFIXES
    )


def file_paths(directory):
    for path in sorted(directory.rglob("*")):
        relative = path.relative_to(directory).as_posix()
        if excluded(relative):
            continue
        if path.is_symlink():
            fail("Symlinks are not packaged: " + relative)
        if path.is_file():
            yield path


def safe_copy(source, destination):
    if source.is_symlink():
        fail("Source directories must not be symlinks: " + source.name)
    destination.mkdir(parents=True, exist_ok=True)
    for path in file_paths(source):
        target = destination / path.relative_to(source)
        target.parent.mkdir(parents=True, exist_ok=True)
        shutil.copyfile(path, target)


def validated_origin(value):
    if value is None:
        return None
    parsed = urlsplit(value)
    if (
        parsed.scheme != "https" or not parsed.netloc or not parsed.hostname
        or any(character.isspace() for character in value)
        or parsed.username or parsed.password or parsed.query or parsed.fragment
        or parsed.path not in ("", "/")
        or parsed.hostname.endswith(".chatgpt.site")
    ):
        fail("--site-url must be the actual external HTTPS origin, without a path, credentials, query or fragment")
    try:
        parsed.port
    except ValueError:
        fail("--site-url has an invalid port")
    return "https://" + parsed.netloc


class TagAttributes(HTMLParser):
    def __init__(self, text):
        super().__init__()
        self.attrs = {}
        self.feed(text)

    def handle_starttag(self, tag, attrs):
        self.attrs = {key.lower(): value or "" for key, value in attrs}


def page_url(origin, relative):
    name = relative.as_posix()
    if name == "index.html":
        return origin + "/"
    if name.endswith("/index.html"):
        return origin + "/" + name[:-10]
    return origin + "/" + name.removesuffix(".html")


def portable_html(text, relative, origin):
    """Change host-dependent metadata only, leaving original assets untouched."""
    head_match = re.search(r"<head\b[^>]*>([\s\S]*?)</head\s*>", text, re.I)
    if not head_match:
        fail("Missing HTML head: " + relative.as_posix())
    head = head_match.group(1)

    def filter_tag(match):
        tag = match.group(0)
        attrs = TagAttributes(tag).attrs
        if tag.lower().startswith("<link") and "canonical" in attrs.get("rel", "").lower().split():
            return ""
        key = attrs.get("property", attrs.get("name", "")).lower()
        if key == "og:url" or key.startswith("og:image") or key.startswith("twitter:image"):
            return ""
        return tag

    head = re.sub(r"<(?:meta|link)\b[^>]*>", filter_tag, head, flags=re.I)
    if re.search(r"https?://[^\s\"'<>]+\.chatgpt\.site", head, re.I):
        fail("An original-host URL remains in the HTML head: " + relative.as_posix())
    if origin:
        url = html.escape(page_url(origin, relative), quote=True)
        image_url = html.escape(origin + "/assets/social-card.png", quote=True)
        head += (
            f'\n  <link rel="canonical" href="{url}">\n'
            f'  <meta property="og:url" content="{url}">\n'
            f'  <meta property="og:image" content="{image_url}">\n'
            '  <meta property="og:image:width" content="1200">\n'
            '  <meta property="og:image:height" content="630">\n'
            '  <meta property="og:image:alt" content="Wheelprints recorded-art studies">\n'
            f'  <meta name="twitter:image" content="{image_url}">\n'
        )
    return text[:head_match.start(1)] + head + text[head_match.end(1):]


class LocalReferences(HTMLParser):
    def __init__(self):
        super().__init__()
        self.refs = []

    def handle_starttag(self, tag, attrs):
        attrs = dict(attrs)
        if tag in ("script", "img", "source", "iframe") and attrs.get("src"):
            self.refs.append(attrs["src"])
        if tag == "link" and attrs.get("href") and attrs.get("rel", "").lower() != "canonical":
            self.refs.append(attrs["href"])


def validate_local_assets(site):
    for page in site.rglob("*.html"):
        parser = LocalReferences()
        parser.feed(page.read_text(encoding="utf-8"))
        for reference in parser.refs:
            parsed = urlsplit(reference)
            if parsed.scheme or parsed.netloc or not parsed.path:
                continue
            decoded = unquote(parsed.path)
            target = site / decoded.lstrip("/") if decoded.startswith("/") else page.parent / decoded
            target = target.resolve()
            if not target.is_relative_to(site.resolve()) or not target.is_file():
                fail(f"Missing or out-of-root asset in {page.relative_to(site)}: {reference}")


def file_record(path, root):
    content = path.read_bytes()
    return {
        "path": path.relative_to(root).as_posix(),
        "bytes": len(content),
        "sha256": hashlib.sha256(content).hexdigest(),
    }


def write_manifest(directory, origin, bundle_type):
    name = "BUILD_MANIFEST.json" if bundle_type == "static" else "PACKAGE_MANIFEST.json"
    records = [file_record(path, directory) for path in file_paths(directory) if path.name != name]
    manifest = {
        "formatVersion": 1,
        "project": PROJECT_NAME,
        "bundleType": bundle_type,
        "chainId": 11155111,
        "siteOrigin": origin,
        "uploadedByThisScript": False,
        "fileCountIncludingManifest": len(records) + 1,
        "files": records,
    }
    (directory / name).write_text(json.dumps(manifest, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    return manifest


def check_static_limits(site):
    paths = list(file_paths(site))
    if len(paths) > MAX_FILES:
        fail(f"Pages dashboard upload permits {MAX_FILES} files; this bundle has {len(paths)}")
    for path in paths:
        if path.stat().st_size > MAX_ASSET_BYTES:
            fail("Asset exceeds Cloudflare's 25 MiB limit: " + path.relative_to(site).as_posix())
    return paths


def archive(directory, destination):
    pending = destination.with_suffix(destination.suffix + ".partial")
    try:
        with zipfile.ZipFile(pending, "w", compression=zipfile.ZIP_DEFLATED, compresslevel=9) as output:
            for path in file_paths(directory):
                relative = path.relative_to(directory).as_posix()
                info = zipfile.ZipInfo(relative, date_time=(2026, 10, 31, 0, 0, 0))
                info.compress_type = zipfile.ZIP_DEFLATED
                info.external_attr = 0o100644 << 16
                output.writestr(info, path.read_bytes(), compress_type=zipfile.ZIP_DEFLATED, compresslevel=9)
        with zipfile.ZipFile(pending) as check:
            bad = check.testzip()
            if bad:
                fail("ZIP integrity check failed: " + bad)
            for name in check.namelist():
                if excluded(name) or name.startswith("/") or ".." in PurePosixPath(name).parts:
                    fail("Disallowed ZIP member: " + name)
        pending.replace(destination)
    finally:
        if pending.exists():
            pending.unlink()


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--site-url", help="Actual Cloudflare/custom HTTPS origin, once assigned")
    args = parser.parse_args()
    origin = validated_origin(args.site_url)
    missing = ["dist/" + name for name in PUBLIC_REQUIRED if not (ROOT / "dist" / name).is_file()]
    missing += [name for name in DEVELOPER_REQUIRED if not (ROOT / name).is_file()]
    if missing:
        fail("Rehearsal release is incomplete. Required files missing: " + ", ".join(missing))
    OUTPUT.mkdir(exist_ok=True)
    with tempfile.TemporaryDirectory(prefix="cloudflare-package-", dir=OUTPUT) as temporary:
        work = Path(temporary)
        site = work / "site"
        safe_copy(ROOT / "dist", site)
        for path in site.rglob("*.html"):
            path.write_text(portable_html(path.read_text(encoding="utf-8"), path.relative_to(site), origin), encoding="utf-8")
        for name in ("_headers", "404.html"):
            shutil.copyfile(ROOT / "hosting" / name, site / name)
        shutil.copyfile(ROOT / "hosting" / "README.md", site / "README_TESTNET_LAUNCH.txt")
        deployment = site / "testnet" / "deployment.json"
        if not deployment.exists():
            deployment.write_text("{}\n", encoding="utf-8")
        if not isinstance(json.loads(deployment.read_text(encoding="utf-8")), dict):
            fail("testnet/deployment.json must be a JSON object")
        validate_local_assets(site)
        static_manifest = write_manifest(site, origin, "static")
        check_static_limits(site)

        developer = work / "developer"
        developer.mkdir()
        safe_copy(site, developer / "dist")
        for name in DEVELOPER_DIRS:
            if (ROOT / name).is_dir():
                safe_copy(ROOT / name, developer / name)
        for name in DEVELOPER_FILES:
            if (ROOT / name).is_symlink():
                fail("Root file symlinks are not packaged: " + name)
            if (ROOT / name).is_file():
                shutil.copyfile(ROOT / name, developer / name)
        for path in sorted(ROOT.glob("*.md")):
            if path.name.startswith(".") or excluded(path.name):
                continue
            if path.is_symlink():
                fail("Root Markdown symlinks are not packaged: " + path.name)
            if path.is_file():
                shutil.copyfile(path, developer / path.name)
        shutil.copyfile(ROOT / "hosting" / "README.md", developer / "README_TESTNET_LAUNCH.md")
        write_manifest(developer, origin, "developer")

        archive(site, OUTPUT / STATIC_NAME)
        archive(developer, OUTPUT / DEVELOPER_NAME)
        staged = OUTPUT / "cloudflare-static"
        if staged.exists():
            marker = staged / "BUILD_MANIFEST.json"
            if not marker.is_file() or json.loads(marker.read_text()).get("project") != PROJECT_NAME:
                fail("Refusing to replace an unrecognized staging directory: " + str(staged))
            shutil.rmtree(staged)
        shutil.copytree(site, staged)

    report = {
        "project": PROJECT_NAME,
        "staticFiles": static_manifest["fileCountIncludingManifest"],
        "largestAssetBytes": max(path.stat().st_size for path in staged.rglob("*") if path.is_file()),
        "dashboardFileLimit": MAX_FILES,
        "perAssetByteLimit": MAX_ASSET_BYTES,
        "siteOrigin": origin,
        "archives": [
            {"file": name, "bytes": (OUTPUT / name).stat().st_size, "sha256": hashlib.sha256((OUTPUT / name).read_bytes()).hexdigest()}
            for name in (STATIC_NAME, DEVELOPER_NAME)
        ],
    }
    print(json.dumps(report, indent=2))


if __name__ == "__main__":
    try:
        main()
    except (ValueError, OSError, json.JSONDecodeError) as error:
        print("Packaging failed: " + str(error), file=sys.stderr)
        sys.exit(1)
