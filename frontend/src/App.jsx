import {
  RouterProvider,
  createBrowserRouter,
  createRoutesFromElements,
  Route,
  Navigate,
} from "react-router-dom";
import Me from "./Me";

import Dashboard from "./pages/Dashboard";
import Encrypted from "./pages/EncryptedFiles.jsx";
import CloudStorage from "./pages/CloudStorage.jsx";
import Signup from "./pages/Signup";
import Login from "./pages/Login";
const router = (user) =>
  createBrowserRouter(
    createRoutesFromElements(
      <>
        <Route
          path="/dashboard"
          element={user ? <Dashboard /> : <Navigate to="/register" />}
        ></Route>
        <Route
          path="/encrypted-files"
          element={user ? <Encrypted /> : <Navigate to="/register" />}
        ></Route>
        <Route
          path="/cloud-storage"
          element={user ? <CloudStorage /> : <Navigate to="/register" />}
        ></Route>
        <Route
          path="/register"
          element={!user ? <Signup /> : <Navigate to="/dashboard" />}
        />
        <Route
          path="/login"
          element={!user ? <Login /> : <Navigate to="/dashboard" />}
        />
      </>
    )
  );

function App() {
  const user = JSON.parse(localStorage.getItem("user"));
  console.log(user);
  return (
    <>
      <RouterProvider router={router(user)} />
    </>
  );
}

export default App;
