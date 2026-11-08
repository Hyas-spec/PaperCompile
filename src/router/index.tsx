import { createBrowserRouter, Navigate } from 'react-router-dom';
import AppLayout from '../layouts/AppLayout';
import { PAGE_ROUTES } from './routes';

export const router = createBrowserRouter([
  {
    path: '/',
    element: <AppLayout />,
    children: [
      { index: true, element: <Navigate to={PAGE_ROUTES[0].path} replace /> },
      ...PAGE_ROUTES.map(({ path, component: Page }) => ({
        path: path.slice(1),
        element: <Page />,
      })),
    ],
  },
]);
