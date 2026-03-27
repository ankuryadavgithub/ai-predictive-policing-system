import { useNavigate } from "react-router-dom";

const navItems = [
  { label: "Capabilities", id: "capabilities" },
  { label: "Workflow", id: "workflow" },
  { label: "Audience", id: "audiences" },
  { label: "About", id: "about" },
];

const Navbar = () => {
  const navigate = useNavigate();

  const scrollToSection = (id) => {
    document.getElementById(id)?.scrollIntoView({
      behavior: "smooth",
      block: "start",
    });
  };

  return (
    <header className="navbar">
      <button className="logo" onClick={() => scrollToSection("hero")} type="button">
        <span className="logo-mark" />
        <span>Crime AI Command</span>
      </button>

      <nav className="nav-links" aria-label="Landing page">
        {navItems.map((item) => (
          <button key={item.id} type="button" onClick={() => scrollToSection(item.id)}>
            {item.label}
          </button>
        ))}
      </nav>

      <div className="nav-actions">
        <button className="nav-login" onClick={() => navigate("/login")} type="button">
          Login
        </button>
      </div>
    </header>
  );
};

export default Navbar;
