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
import News from "./routes/news";
import Forum from "./routes/forum";
import ForumSection from "./routes/forum/section";
import ForumPost from "./routes/forum/post";
import ForumNewPost from "./routes/forum/new";
import ForumEditPost from "./routes/forum/edit";
import ForumAdminReports from "./routes/forum/admin/reports";
import ForumAdminAnnouncements from "./routes/forum/admin/announcements";

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
        path: "news",
        element: <News />,
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
      {
        path: "forum",
        element: <Forum />,
        errorElement: <ErrorPage />,
      },
      {
        path: "forum/section/:sectionId",
        element: <ForumSection />,
        errorElement: <ErrorPage />,
      },
      {
        path: "forum/post/:postId",
        element: <ForumPost />,
        errorElement: <ErrorPage />,
      },
      {
        path: "forum/new",
        element: <ForumNewPost />,
        errorElement: <ErrorPage />,
      },
      {
        path: "forum/edit/:postId",
        element: <ForumEditPost />,
        errorElement: <ErrorPage />,
      },
      {
        path: "forum/admin/reports",
        element: <ForumAdminReports />,
        errorElement: <ErrorPage />,
      },
      {
        path: "forum/admin/announcements",
        element: <ForumAdminAnnouncements />,
        errorElement: <ErrorPage />,
      },
    ],
  },
]); 