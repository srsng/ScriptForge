import Ajv2020 from "ajv/dist/2020.js";
import addFormats from "ajv-formats";
import { readFile } from "node:fs/promises";

const [schemaJson, fixtureJson] = await Promise.all([
  readFile(new URL("../schema/scriptforge.schema.json", import.meta.url), "utf8"),
  readFile(new URL("../samples/scriptforge-demo.json", import.meta.url), "utf8"),
]);

const schema = JSON.parse(schemaJson);
const fixture = JSON.parse(fixtureJson);
const ajv = new Ajv2020({ allErrors: true, strict: false });
addFormats(ajv);

const validate = ajv.compile(schema);
const isValid = validate(fixture);

if (!isValid) {
  console.error("ScriptForge demo fixture failed schema validation:");
  console.error(JSON.stringify(validate.errors, null, 2));
  process.exit(1);
}

const sourceChapters = fixture.script?.source?.chapters ?? [];
if (sourceChapters.length < 3) {
  console.error(`ScriptForge demo fixture must include at least 3 source chapters, found ${sourceChapters.length}.`);
  process.exit(1);
}

console.log(
  `ScriptForge demo fixture OK: ${sourceChapters.length} chapters, ${fixture.script.scenes.length} scenes, ${fixture.script.characters.length} characters.`,
);
