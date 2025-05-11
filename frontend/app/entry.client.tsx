import React from 'react'
import ReactDOM from 'react-dom/client'
import { createBrowserRouter, RouterProvider } from 'react-router-dom'
import { routes } from './routes'

const router = createBrowserRouter(routes)

ReactDOM.hydrateRoot(
  document,
  <React.StrictMode>
    <RouterProvider router={router} />
  </React.StrictMode>
) 