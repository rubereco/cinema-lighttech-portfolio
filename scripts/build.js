#!/usr/bin/env node
"use strict";

// Decap edits one JSON file per film/person. The public site consumes the
// compact aggregates generated here during the Cloudflare Pages build.
const fs = require("node:fs");
const path = require("node:path");
const root = path.resolve(__dirname, "..");

// A Pages preview must edit the JSON from its own branch. The source config
// always targets main, so production and local builds keep their normal backend.
const pagesBranch = process.env.CF_PAGES_BRANCH;
if (pagesBranch && pagesBranch !== "main") {
  if (!/^[A-Za-z0-9][A-Za-z0-9._/-]*$/.test(pagesBranch) || pagesBranch.includes("..")) {
    throw new Error(`Invalid Cloudflare Pages branch: ${pagesBranch}`);
  }
  const configPath = path.join(root, "admin", "config.yml");
  const config = fs.readFileSync(configPath, "utf8");
  const backendBranch = /^  branch: main\r?$/gm;
  if ([...config.matchAll(backendBranch)].length !== 1) {
    throw new Error("Expected one main backend branch in admin/config.yml");
  }
  fs.writeFileSync(configPath, config.replace(backendBranch, `  branch: ${pagesBranch}`));
  console.log(`  admin backend: ${pagesBranch}`);
}

const translationEntries = JSON.parse(fs.readFileSync(path.join(root, "data", "i18n.json"), "utf8")).entries;
const translationKeys = new Set();
const editorLabels = new Set();
for (const entry of translationEntries) {
  if (!entry.key || !entry.en || !entry.es || translationKeys.has(entry.key)) {
    throw new Error(`Invalid or duplicate translation key: ${entry.key}`);
  }
  if (!entry.editorLabel || editorLabels.has(entry.editorLabel)) {
    throw new Error(`Missing or duplicate translation editor label: ${entry.key}`);
  }
  translationKeys.add(entry.key);
  editorLabels.add(entry.editorLabel);
}
for (const page of ["index.html", "legal.html"]) {
  const html = fs.readFileSync(path.join(root, page), "utf8");
  for (const match of html.matchAll(/data-i18n(?:-html)?="([^"]+)"|data-i18n-attr="([^"]+)"/g)) {
    const keys = match[1] ? [match[1]] : match[2].split(";").map(part => part.split(":")[1]);
    for (const key of keys) {
      if (!translationKeys.has(key)) throw new Error(`${page}: missing translation ${key}`);
    }
  }
}
for (const key of [
  "film.watchTrailer", "film.trailerTitle", "film.posterAlt", "about.photoPosition",
  "partners.website", "partners.empty", "partners.logosLabel",
  "partners.count.partner_one", "partners.count.partner_other",
  ...["direction", "cinematography", "lighting", "sound", "production", "other"].map(id => `partners.section.${id}`),
]) {
  if (!translationKeys.has(key)) throw new Error(`Missing translation ${key}`);
}

function readCollection(name) {
  const dir = path.join(root, "data", name);
  return fs.readdirSync(dir)
    .filter(file => file.endsWith(".json"))
    .map(file => {
      const item = JSON.parse(fs.readFileSync(path.join(dir, file), "utf8"));
      if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(item.id || "") || file !== `${item.id}.json`) {
        throw new Error(`${name}/${file}: id must use lowercase letters, numbers and hyphens and match its filename`);
      }
      return item;
    });
}

function writeAggregate(name, items) {
  fs.writeFileSync(
    path.join(root, "data", `${name}.json`),
    JSON.stringify({ [name]: items }, null, 2) + "\n"
  );
  console.log(`  ${name}: ${items.length} entries`);
}

const films = readCollection("films");
const ids = new Set();
const positions = new Set();
for (const film of films) {
  if (ids.has(film.id)) throw new Error(`Duplicate film id: ${film.id}`);
  ids.add(film.id);
  // Decap can serialize a cleared optional number field as an empty string.
  // A blank order intentionally hides the film from Selected Work.
  if (typeof film.displayOrder === "string" && !film.displayOrder.trim()) {
    film.displayOrder = null;
  }
  if (!film.title || !Number.isInteger(film.year)) {
    throw new Error(`${film.id}: title and year are required`);
  }
  if (film.displayOrder != null) {
    if (!film.poster) throw new Error(`${film.id}: a visible film needs a poster`);
    if (!fs.existsSync(path.join(root, film.poster.replace(/^\/+/, "")))) {
      throw new Error(`${film.id}: poster file does not exist`);
    }
    if (!Number.isInteger(film.displayOrder) || film.displayOrder < 1) {
      throw new Error(`${film.id}: displayOrder must be a positive integer`);
    }
    if (positions.has(film.displayOrder)) {
      throw new Error(`${film.id}: duplicate displayOrder ${film.displayOrder}`);
    }
    positions.add(film.displayOrder);
  }
  if (film.trailerUrl) {
    const url = new URL(film.trailerUrl);
    if (url.protocol !== "https:") throw new Error(`${film.id}: trailer URL must use HTTPS`);
  }
  if (!translationKeys.has(`roles.${film.role}`) || !translationKeys.has(`filmType.${film.type}`)) {
    throw new Error(`${film.id}: missing role or type translation`);
  }
}
films.sort((a, b) =>
  (a.displayOrder ?? Infinity) - (b.displayOrder ?? Infinity) ||
  (b.year ?? 0) - (a.year ?? 0) ||
  a.id.localeCompare(b.id)
);
writeAggregate("films", films);

const heroPhotos = JSON.parse(fs.readFileSync(path.join(root, "data", "hero.json"), "utf8")).items || [];
const photoIds = new Set();
for (const photo of heroPhotos) {
  if (!photo.id || !photo.file || !["big", "small"].includes(photo.size) || photoIds.has(photo.id) ||
      !fs.existsSync(path.join(root, photo.file.replace(/^\/+/, ""))) ||
      (photo.size === "small" && !translationKeys.has(`about.photo.${photo.id}.alt`))) {
    throw new Error(`Invalid hero photo or missing About alt translation: ${photo.id}`);
  }
  photoIds.add(photo.id);
}
if (!heroPhotos.some(photo => photo.size === "big") || !heroPhotos.some(photo => photo.size === "small")) {
  throw new Error("Hero needs a large photo; About needs a small photo");
}

const people = readCollection("people");
for (const person of people) if (!person.name) throw new Error(`${person.id}: name is required`);
people.sort((a, b) => a.name.localeCompare(b.name));
writeAggregate("people", people);
