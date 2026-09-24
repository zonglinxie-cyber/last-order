import { CUSTOMERS, type CustomerId } from "../dynamic-counter-prototype/src/campaign";
import { asset } from "./sim/asset";

/** Full plates keep their 853×1844 landmark geometry; small UI uses 148px derivatives. */
export function customerPortrait(id: CustomerId, thumbnail = false) {
  const name = CUSTOMERS[id].portrait.split("/").at(-1)!.replace(/\.png$/, "");
  return asset(`assets/optimized/${name}${thumbnail ? "-thumb" : ""}.webp`);
}
export const productArtwork = asset("assets/optimized/product-trio.webp");
