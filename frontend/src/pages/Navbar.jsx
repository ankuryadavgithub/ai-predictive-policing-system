const Navbar = () => {

const scrollToSection = (id) => {

document.getElementById(id).scrollIntoView({
behavior: "smooth"
});

};

return(

<div className="navbar">

<div className="logo">
Predictive Policing
</div>

<div className="nav-links">

<a onClick={()=>scrollToSection("features")}>
Features
</a>

<a onClick={()=>scrollToSection("solutions")}>
Solutions
</a>

<a onClick={()=>scrollToSection("about")}>
About
</a>

<a onClick={()=>scrollToSection("contact")}>
Contact
</a>

</div>

</div>

);

};

export default Navbar;