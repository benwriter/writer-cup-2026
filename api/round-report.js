// V10 intentionally removes Captain's Desk report generation from the archive.
// The file remains as a safe tombstone so an older deployment cannot accept
// report requests after the frontend has moved on.
module.exports=async(_req,res)=>{
 res.setHeader('Cache-Control','no-store');
 return res.status(410).json({error:'Archive report generation has been retired.'});
};
