// A location-level zero is not a product-level zero. Shopify supplies the
// current aggregate across locations; untracked inventory stays unknown.
export function shopifyQuantity(product:{status?:string;tracksInventory?:boolean;totalInventory?:number;allVariantsTracked?:boolean}){
 if(product.status&&product.status!=="ACTIVE")return 0;
 if(product.tracksInventory!==true||!Number.isSafeInteger(product.totalInventory))return null;
 if(product.totalInventory!>0)return product.totalInventory!;
 return product.allVariantsTracked===true?0:null;
}
export function stockLabel(quantity:number|null){return quantity===null?"Stock not tracked":quantity===0?"Out of stock":quantity+" in stock";}
export const INVENTORY_TOPICS=["inventory_levels/update","inventory_levels/connect","inventory_levels/disconnect"];
export function inventorySignalId(value:unknown){
 const id=String(value??"");if(!/^[1-9][0-9]{0,24}$/.test(id))throw new Error("SHOPIFY_INVENTORY_ID_INVALID");return "gid://shopify/InventoryItem/"+id;
}
