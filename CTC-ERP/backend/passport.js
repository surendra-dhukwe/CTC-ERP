// const passport = require("passport");
// const GoogleStrategy = require("passport-google-oauth20").Strategy;
// const db = require("./db");

// passport.use(new GoogleStrategy({
//     clientID: process.env.GOOGLE_CLIENT_ID,
//     clientSecret: process.env.GOOGLE_CLIENT_SECRET,
//     callbackURL: "/auth/google/callback"
// },
// (accessToken, refreshToken, profile, done)=>{

//     db.query("SELECT * FROM users WHERE google_id=?",
//     [profile.id], (err,result)=>{

//         if(result.length > 0){
//             return done(null,result[0]);
//         } else {

//             db.query(
//                 "INSERT INTO users(name,email,google_id) VALUES(?,?,?)",
//                 [
//                     profile.displayName,
//                     profile.emails[0].value,
//                     profile.id
//                 ],
//                 (err,data)=>{
//                     done(null,{
//                         id:data.insertId,
//                         name:profile.displayName
//                     });
//                 }
//             );
//         }
//     });
// }));

// passport.serializeUser((user,done)=>{
//     done(null,user.id);
// });

// passport.deserializeUser((id,done)=>{
//     db.query("SELECT * FROM users WHERE id=?",[id],
//     (err,result)=>{
//         done(null,result[0]);
//     });
// });

// module.exports = passport;