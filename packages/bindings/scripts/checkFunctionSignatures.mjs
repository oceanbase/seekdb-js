import fs from "fs";
import path from "path";

function getFunctionSignaturesFromHeader(headerFilePath) {
  const sigs = [];
  const headerContents = fs.readFileSync(headerFilePath, { encoding: "utf-8" });
  // Match seekdb C API function signatures
  // Pattern: return_type seekdb_function_name(...);
  const sigRegex =
    /^(?<returnType>\w+(?:\s+\*)?)\s+seekdb_\w+\s*\((?<params>[^)]*)\)\s*;$/gm;
  var match;
  while ((match = sigRegex.exec(headerContents)) !== null) {
    const fullSig = `${match.groups.returnType} seekdb_${match[0].match(/seekdb_(\w+)/)?.[1]}(${match.groups.params});`;
    sigs.push({ sig: fullSig.trim().replace(/\s+/g, " ") });
  }

  // Also match typedefs for handles
  const typedefRegex = /^typedef\s+(?<type>.*?)\s+(?<name>SeekDB\w+);$/gm;
  while ((match = typedefRegex.exec(headerContents)) !== null) {
    sigs.push({ sig: `typedef ${match.groups.type} ${match.groups.name};` });
  }

  return sigs;
}

function getFunctionSignaturesFromComments(filePath) {
  const sigs = [];
  if (!fs.existsSync(filePath)) {
    return sigs;
  }
  const fileContents = fs.readFileSync(filePath, { encoding: "utf-8" });
  // Match commented function signatures
  const sigRegex = /^\s*\/\/\s*SEEKDB_C_API\s+(?<sig>([^;])*);$/gm;
  var match;
  while ((match = sigRegex.exec(fileContents)) !== null) {
    sigs.push({ sig: match.groups.sig.trim() });
  }
  return sigs;
}

function checkFunctionSignatures() {
  try {
    if (process.argv[2] === "removeFiles") {
      if (fs.existsSync("headerSigs.json")) {
        fs.rmSync("headerSigs.json");
      }
      if (fs.existsSync("typeDefsSigs.json")) {
        fs.rmSync("typeDefsSigs.json");
      }
      if (fs.existsSync("bindingsSigs.json")) {
        fs.rmSync("bindingsSigs.json");
      }
      return;
    }

    const headerFilePath = path.join("libseekdb", "seekdb.h");
    const typeDefsFilePath = path.join("pkgs", "js-bindings", "seekdb.d.ts");
    const bindingsFilePath = path.join("src", "seekdb_js_bindings.cpp");

    if (!fs.existsSync(headerFilePath)) {
      console.warn(`Warning: Header file not found: ${headerFilePath}`);
      console.warn("Run fetch script first to download the header file.");
      return;
    }

    const headerSigs = getFunctionSignaturesFromHeader(headerFilePath);
    const typeDefsSigs = getFunctionSignaturesFromComments(typeDefsFilePath);
    const bindingsSigs = getFunctionSignaturesFromComments(bindingsFilePath);

    console.log(`Header sigs: ${headerSigs.length}`);
    console.log(`Type defs sigs: ${typeDefsSigs.length}`);
    console.log(`Bindings sigs: ${bindingsSigs.length}`);

    const headerSigsJSON = JSON.stringify(headerSigs, null, 2);
    const typeDefsSigsJSON = JSON.stringify(typeDefsSigs, null, 2);
    const bindingsSigsJSON = JSON.stringify(bindingsSigs, null, 2);

    if (headerSigsJSON === typeDefsSigsJSON) {
      console.log("OK: Type defs sigs match header sigs");
    } else {
      console.warn("WARNING: Type defs sigs DO NOT match header sigs!");
    }

    if (headerSigsJSON === bindingsSigsJSON) {
      console.log("OK: Bindings sigs match header sigs");
    } else {
      console.warn("WARNING: Bindings sigs DO NOT match header sigs!");
    }

    if (process.argv[2] === "writeFiles") {
      fs.writeFileSync("headerSigs.json", headerSigsJSON);
      fs.writeFileSync("typeDefsSigs.json", typeDefsSigsJSON);
      fs.writeFileSync("bindingsSigs.json", bindingsSigsJSON);
    }
  } catch (e) {
    console.error(e);
    process.exit(1);
  }
}

checkFunctionSignatures();
