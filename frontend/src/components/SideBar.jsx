import { NavLink } from "react-router-dom";
import {
  faFile,
  faCloud,
  faPoll,
  faLock,
  faUserSlash,
} from "@fortawesome/free-solid-svg-icons";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";

import Logo from "../assets/images/Logo.png";

import "../css/sidebar.css";

const SideBar = () => {
  const handleLogout = () => {
    localStorage.removeItem("user");
    localStorage.removeItem("userSignedUp");
    localStorage.removeItem("userLoggedIn");

    navigate("/login");
  };
  return (
    <div className="sidebar">
      <img src={Logo} alt="forteFile" />{" "}
      <ul className="sidebarList">
        <NavLink className="links" to="/dashboard">
          <FontAwesomeIcon icon={faFile} className="white-outline" />
          Files
        </NavLink>
        <NavLink to="/encrypted-files" className="links">
          <FontAwesomeIcon icon={faLock} className="white-outline" />
          Encrypted files
        </NavLink>
        <NavLink to="/cloud-storage" className="links">
          <FontAwesomeIcon icon={faCloud} className="white-outline" />
          Cloud Storage
        </NavLink>
        <NavLink className="links" to="*"  style={{display: "none"}}>
          <FontAwesomeIcon icon={faPoll} className="white-outline" />
          Analytics
        </NavLink>
        <NavLink onClick={handleLogout} to="/login">
          <FontAwesomeIcon className="white-outline" icon={faUserSlash} />
          Logout
        </NavLink>
      </ul>
    </div>
  );
};
export default SideBar;
