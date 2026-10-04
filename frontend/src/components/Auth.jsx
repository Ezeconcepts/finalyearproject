import "../css/auth.css";
const API_URL = import.meta.env.VITE_API_URL || "http://localhost:3001";
import securityShield from "../assets/images/SecurityShield-1.png";
import Logo from "../assets/images/Logo.png";
import { useLocation, Link, useNavigate, redirect } from "react-router-dom";
import { useState } from "react";
import { faGoogle } from "@fortawesome/free-brands-svg-icons";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";

const Auth = () => {
  const { pathname } = useLocation();
  const [error, setError] = useState();
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    const formData = new FormData(e.currentTarget);

    const userInfo = Object.fromEntries(formData);
    console.log("here");
    const res = await fetch(`${API_URL}/api/users/${pathname}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(userInfo),
    });

    const data = await res.json();

    if (!res.ok) {
      if (data.error === "Internal Server Error") {
        throw Error("there was an error signing up. Please try again");
      }
    }

    if (data.error === true) {
      setError("please check your details and try again");
      return;
    }

    console.log(data);
    const userName = data.username;
    if (pathname === "/login") {
      localStorage.removeItem("userSignedUp");
      localStorage.setItem(
        "userLoggedIn",
        JSON.stringify({
          loggedIn: true,
          user: data.userId,
          userName,
        })
      );
    }

    if (pathname === "/register") {
      localStorage.removeItem("userLoggedIn");
      localStorage.setItem(
        "userSignedUp",
        JSON.stringify({
          signedUp: true,
          user: data.userId,
          userName,
        })
      );
    }
    console.log("auth");
    localStorage.setItem(
      "user",
      JSON.stringify({
        user: data.userId,
      })
    );
    console.log("redirect");
    window.location.reload();
    navigate(`/dashboard`);
  };

  return (
    <>
      <div className="main">
        <div className="left">
          <div className="inner-left">
            <h2>
              <img src={Logo} alt="" />
            </h2>

            <p>
              <strong>{(pathname === "/login") ? "Log in" : "Sign up"}</strong>
            </p>
            <form onSubmit={handleSubmit}>
              {pathname === "/register" && (
                <input
                  type="text"
                  placeholder="  Full name"
                  name="fullName"
                  required
                />
              )}

              <br />
              <input
                type="email"
                placeholder="Email address"
                name="email"
                required
              />
              <br />
              <input
                type="password"
                placeholder="  Password"
                name="password"
                required
              />
              <br />
              {error && <p className="error">{error}</p>}
              <button className="signUpBtn">
                {pathname === "/login" ? "Sign in" : " Sign up "}
              </button>
              <a
                className="googleSignUpBtn"
                href={`${API_URL}/api/users/google/register`}
              >
                <FontAwesomeIcon icon={faGoogle} size="lg" color="#162EFF" />

                {pathname === "/login"
                  ? "Sign in with Google"
                  : " Sign up with Google"}
              </a>
              <br />
              <small>
                <Link to={pathname === "/login" ? "/register" : "/login"}>
                  Click here,
                </Link>

                {pathname === "/login"
                  ? "If you are new to ForteFile."
                  : "If you have a Fortefile account."}
              </small>
            </form>
          </div>
        </div>
        <div className="right">
          <img src={securityShield} alt="SecurityShield" />
        </div>
      </div>
    </>
  );
};

export default Auth;
