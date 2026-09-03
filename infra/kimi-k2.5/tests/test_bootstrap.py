import hashlib
import importlib.machinery
import importlib.util
import json
import stat
import tempfile
import unittest
from pathlib import Path


SCRIPT = Path(__file__).parents[1] / "bin" / "kimi-bootstrap"
LOADER = importlib.machinery.SourceFileLoader("kimi_bootstrap", str(SCRIPT))
SPEC = importlib.util.spec_from_loader(LOADER.name, LOADER)
MODULE = importlib.util.module_from_spec(SPEC)
LOADER.exec_module(MODULE)


class BootstrapTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.root = Path(self.temp.name)
        self.source = self.root / "source"
        self.destination = self.root / "destination"
        self.source.mkdir()
        files = []
        for name, content in (("shards/one.gguf", b"one"), ("shards/two.gguf", b"second shard")):
            path = self.source / name
            path.parent.mkdir(parents=True, exist_ok=True)
            path.write_bytes(content)
            files.append({"path": name, "size": len(content), "sha256": hashlib.sha256(content).hexdigest()})
        self.manifest = {
            "schemaVersion": 1,
            "entrypoint": files[0]["path"],
            "totalSize": sum(item["size"] for item in files),
            "files": files,
        }
        self.manifest_path = self.root / "manifest.json"
        self.manifest_path.write_text(json.dumps(self.manifest), encoding="utf-8")
        self.fake_aws = self.root / "aws"
        self.fake_aws.write_text(
            "#!/bin/sh\n"
            "set -eu\n"
            "src=$4\n"
            "dst=$5\n"
            "case \"$src\" in file://*) src=${src#file://};; esac\n"
            "cp \"$src\" \"$dst\"\n",
            encoding="utf-8",
        )
        self.fake_aws.chmod(self.fake_aws.stat().st_mode | stat.S_IXUSR)

    def tearDown(self):
        self.temp.cleanup()

    def test_download_validates_and_marks_ready(self):
        MODULE.download(
            self.manifest,
            self.manifest_path,
            f"file://{self.source}",
            self.destination,
            2,
            str(self.fake_aws),
        )
        MODULE.validate_ready(self.manifest, self.manifest_path, self.destination)
        self.assertEqual((self.destination / "shards/one.gguf").read_bytes(), b"one")

    def test_corrupt_download_is_removed(self):
        self.manifest["files"][0]["sha256"] = "0" * 64
        with self.assertRaises(RuntimeError):
            MODULE.download_file(
                f"file://{self.source}",
                self.destination,
                self.manifest["files"][0],
                str(self.fake_aws),
            )
        self.assertFalse((self.destination / "shards/one.gguf.partial").exists())
        self.assertFalse((self.destination / "shards/one.gguf").exists())

    def test_manifest_rejects_parent_path(self):
        self.manifest["files"][0]["path"] = "../outside.gguf"
        self.manifest["entrypoint"] = "../outside.gguf"
        self.manifest_path.write_text(json.dumps(self.manifest), encoding="utf-8")
        with self.assertRaises(ValueError):
            MODULE.load_manifest(self.manifest_path)

    def test_changed_manifest_invalidates_marker(self):
        MODULE.download(
            self.manifest,
            self.manifest_path,
            f"file://{self.source}",
            self.destination,
            2,
            str(self.fake_aws),
        )
        self.manifest["source"] = {"revision": "different"}
        self.manifest_path.write_text(json.dumps(self.manifest), encoding="utf-8")
        with self.assertRaises(RuntimeError):
            MODULE.validate_ready(self.manifest, self.manifest_path, self.destination)

    def test_server_template_substitution(self):
        command = MODULE.render_command(
            ["llama-server", "-m", "{model}", "--host", "{host}", "--port", "{port}"],
            Path("/model.gguf"),
            "127.0.0.1",
            8000,
        )
        self.assertEqual(command, ["llama-server", "-m", "/model.gguf", "--host", "127.0.0.1", "--port", "8000"])


if __name__ == "__main__":
    unittest.main()
