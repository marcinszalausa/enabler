// Checkout remains closed independently of public policy wording.
export async function POST(){
 return Response.json({code:"CHECKOUT_NOT_AVAILABLE",message:"Paid checkout is currently unavailable."},{status:503,headers:{"Cache-Control":"no-store"}});
}
