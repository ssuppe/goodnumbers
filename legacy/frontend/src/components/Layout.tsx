// file: frontend/src/components/Layout.tsx
import { Outlet } from 'react-router-dom';
import Banner from './Banner';
import Header from './Header';
import Footer from './Footer';

export function Layout() {
  return (
    <>
      <Banner />
      <Header />
      <main>
        <Outlet />
      </main>
      <Footer />
    </>
  );
}
