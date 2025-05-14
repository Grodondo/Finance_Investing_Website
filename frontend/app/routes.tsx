import React from "react";
import { createBrowserRouter } from "react-router-dom";
import Root from "./root";
import ErrorPage from "./components/ErrorPage";
import Index from "./routes/_index";
import Login from "./routes/login";
import Register from "./routes/register";
import Dashboard from "./routes/dashboard";
import Investing from "./routes/investing";
import About from "./routes/about";
import Recommendations from "./routes/recommendations";
import Profile from "./routes/profile";

export const router = createBrowserRouter([
  {
    path: "/",
    element: <Root />,
    errorElement: <ErrorPage />,
    children: [
      {
        index: true,
        element: <Index />,
      },
      {
        path: "login",
        element: <Login />,
      },
      {
        path: "register",
        element: <Register />,
      },
      {
        path: "dashboard",
        element: <Dashboard />,
      },
      {
        path: "investing",
        element: <Investing />,
        errorElement: <ErrorPage />,
      },
      {
        path: "recommendations",
        element: <Recommendations />,
        errorElement: <ErrorPage />,
      },
      {
        path: "about",
        element: <About />,
      },
      {
        path: "profile",
        element: <Profile />,
        errorElement: <ErrorPage />,
      },
    ],
  },
]); 