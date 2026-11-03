// Deliberately closed: no payment SDK, credentials, customer lookup or session creation.
// A future implementation must satisfy docs/legal-launch-gates.md before replacing this.
export async function POST(){
 return Response.json({code:"CHECKOUT_NOT_AVAILABLE",message:"Paid checkout is not available during pre-launch."},{status:503,headers:{"Cache-Control":"no-store"}});
}
