import data from "./homepage-media.json";

// Reviewed, first-party public exports. The landing page never needs a database
// or a third-party image host to put its first examples on screen.
export type StudioAd = {id:string;product:string;label:string;alt:string;image:string;video?:string};
const image=(id:keyof typeof data.images)=>data.images[id].src;
export const STUDIO_ADS:StudioAd[]=[
 {id:"walk",product:"walk-set",label:"Pet essentials",alt:"A golden retriever wearing a coordinated walking set outdoors",image:data.videos["453cb5db-5f27-4289-9749-306e23b98cf4"].poster,video:data.videos["453cb5db-5f27-4289-9749-306e23b98cf4"].src},
 {id:"robe",product:"waffle-robe",label:"Everyday comfort",alt:"A robe that won't make you overheat",image:image("44358942-fd36-43bc-8f85-bf7e7c83becf")},
 {id:"cardigan",product:"hug-cardigan",label:"Effortless style",alt:"From pajamas to jeans, one soft layer",image:image("45b0071f-cfd7-48d5-bf4a-5cb4e8eec558")},
 {id:"lounge",product:"cabin-loungewear",label:"Made for slow days",alt:"Loungewear that's warm, not bulky",image:image("b92d62b1-bdb8-4783-bbfa-4ad05eeae68d")},
 {id:"set",product:"lounge-set",label:"A softer everyday",alt:"Free size exchanges, easy returns",image:image("4d8bf40f-6e73-4210-a15c-aeef992d8495")},
];
export const STUDIO_SOURCE=Object.values(data.photos)[0].src;
export const STUDIO_FEED=image("a48dc2a0-0f50-41b8-b193-8538286ec600");
export const STUDIO_STORY=image("45b0071f-cfd7-48d5-bf4a-5cb4e8eec558");
export const STUDIO_BRAND=image("833044a9-ccec-4b91-ac7a-fa297b4ce6d3");


// Approved public creatives, verified to share the Hug Cardigan product.
export const STUDIO_PRODUCT_ANGLES=[
 {angle:"benefit",feed:image("a48dc2a0-0f50-41b8-b193-8538286ec600"),story:image("45b0071f-cfd7-48d5-bf4a-5cb4e8eec558"),alt:"From pajamas to jeans, one soft layer"},
 {angle:"curiosity",feed:image("250c3780-9d5c-42d7-a8e5-1d780d632d0b"),story:image("6219e1e5-5564-4d9c-b129-6d6adcc7164c"),alt:"Why it's called The Hug Cardigan"},
 {angle:"social_proof",feed:image("833044a9-ccec-4b91-ac7a-fa297b4ce6d3"),story:image("c9d45f6e-a74e-4f03-9515-412c68f1b5ae"),alt:"Made for the slow-morning crowd"},
] as const;
