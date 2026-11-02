// Next automatically copies loaded .env files into standalone output. Remove
// only generated copies; never read, alter, rename or copy developer .env files.
import { readdir, realpath, lstat, unlink } from "node:fs/promises";
import { resolve, join, relative, isAbsolute } from "node:path";
const repo = resolve(import.meta.dirname, "..");
let removed = 0;
for (const app of ["admin", "frontend"]) {
  const expected = join(repo, "apps", app, ".next", "standalone");
  let root;
  try { root = await realpath(expected); } catch (e) { if (e.code === "ENOENT") continue; throw e; }
  if (root !== expected) throw Error("Standalone output must not be redirected outside its build directory");
  async function walk(directory) {
    for (const entry of await readdir(directory, { withFileTypes: true })) {
      const file = join(directory, entry.name); const rel = relative(root, file);
      if (isAbsolute(rel) || rel.startsWith("..")) throw Error("Invalid generated output path");
      if (entry.isSymbolicLink()) {
        if (entry.name === ".env" || entry.name.startsWith(".env.") || /\.(pem|key|p12|pfx)$/i.test(entry.name)) throw Error("Sensitive artifact link requires packaging review");
        continue;
      }
      if (entry.isDirectory()) await walk(file);
      else if (entry.name === ".env" || entry.name.startsWith(".env.")) {
        if (!(await lstat(file)).isFile()) throw Error("Unexpected environment artifact type");
        await unlink(file); removed++;
      } else if (/\.(pem|key|p12|pfx)$/i.test(entry.name)) throw Error("Private-key/certificate artifact requires packaging review (contents withheld)");
    }
  }
  await walk(root);
}
console.log(JSON.stringify({ generatedEnvironmentCopiesRemoved: removed, developerEnvironmentsUntouched: true }));
