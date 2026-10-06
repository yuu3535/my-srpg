"use strict";

const background = document.getElementById("background");
const size = document.getElementById("icon-size");
const output = document.getElementById("size-value");

function updateSize() {
  const pixels = Number(size.value);
  output.textContent = `${pixels}px`;
  for (const id of ["small-icon", "tile-icon"]) {
    const icon = document.getElementById(id);
    icon.width = pixels;
    icon.height = pixels;
  }
}
background.addEventListener("change", () => { document.body.dataset.background = background.value; });
size.addEventListener("input", updateSize);
for (const image of document.querySelectorAll("img")) {
  image.addEventListener("error", () => { document.getElementById("asset-error").hidden = false; });
}
updateSize();
