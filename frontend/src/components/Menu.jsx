import { useState, useRef, useEffect } from "react";
import { Link, NavLink, useNavigate } from "react-router-dom";
import UploadDetails from "../components/UploadDetails";

import {
  faBars,
  faClose,
  faUserSlash,
  faFile,
  faLock,
  faCloud,
  faPoll,
} from "@fortawesome/free-solid-svg-icons";

import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";


const Menu = () => {
  const [icon, setIcon] = useState(faBars);
  const hamburgerRef = useRef(null);
  const hamburgerContentRef = useRef(null);
      useEffect(() => {
        console.log(hamburgerRef, hamburgerContentRef);
        hamburgerRef.current.addEventListener("click", function () {
          if (hamburgerContentRef.current.style.display == "block") {
            console.log("yes");

            hamburgerContentRef.current.style.display = "none";
            setIcon(faBars);
          } else {
            hamburgerContentRef.current.style.display = "block";
            console.log("no");

            setIcon(faClose);
          }
          hamburgerContentRef.current.style.top =
            hamburgerRef.current.clientHeight + 20 + "px";
        });
      }, []);
    
    
      const handleLogout = () => {
        console.log("one second");
        localStorage.removeItem("user");
        localStorage.removeItem("userSignedUp");
        localStorage.removeItem("userLoggedIn");
        console.log("redirectingg");
        navigate("/login", { reload: true });
      };
  return (
    <>
      <FontAwesomeIcon
        icon={icon}
        className="hamburger white-outline"
        ref={hamburgerRef}
      />
      <div class="hamburger-content" ref={hamburgerContentRef}>
        <NavLink to="/dashboard">
          <FontAwesomeIcon icon={faFile} className="white-outline" />
          Files
        </NavLink>
        <NavLink to="/encrypted-files">
          <FontAwesomeIcon icon={faLock} className="white-outline" />
          Encrypted files
        </NavLink>
        <NavLink to="/cloud-storage" className="links">
          <FontAwesomeIcon icon={faCloud} className="white-outline" />
          Cloud Storage
        </NavLink>
        <NavLink className="links" to="*">
          <FontAwesomeIcon icon={faPoll} className="white-outline" />
          Analytics
        </NavLink>
        <NavLink onClick={handleLogout} to="/login" className=" links">
          <FontAwesomeIcon icon={faUserSlash} className="white-outline" />
          Logout
        </NavLink>
      </div>
    </>
  );
};
export default Menu;
