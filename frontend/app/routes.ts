import { lazy } from "react";
import Root from "./root";

export const routes = [
  {
    path: "/",
    Component: Root,
    children: [
      {
        index: true,
        Component: lazy(() => import("./routes/_index")),
      },
      {
        path: "login",
        Component: lazy(() => import("./routes/login")),
      },
      {
        path: "dashboard",
        Component: lazy(() => import("./routes/dashboard")),
      },
      {
        path: "register",
        Component: lazy(() => import("./routes/register")),
      },
      {
        path: "forgot-password",
        Component: lazy(() => import("./routes/forgot-password")),
      },
      {
        path: "about",
        Component: lazy(() => import("./routes/about")),
      },
    ],
  },
];