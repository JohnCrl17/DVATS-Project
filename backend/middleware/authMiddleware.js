module.exports = (req, res, next) => {
    // If the user is logged in, let them through
    if (req.session && req.session.userId) {
        return next();
    }
    
    // If they are asking for a page like dashboard.html, kick them to login
    // BUT do NOT block them from getting their CSS or JS files!
    res.redirect('/login.html');
};