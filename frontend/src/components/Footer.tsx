import { Link } from "react-router-dom";

export default function Footer() {
  return (
    <footer className="mt-12 py-8 border-t border-gray-200">
      <div className="max-w-7xl mx-auto px-4 sm:px-4 lg:px-8 text-center text-sm text-gray-500">
        &copy; 2025 GoodNumbers, Inc. | Experimental Journal for T1D. |{" "}
        <Link to="/privacy" className="hover:text-gray-700">
          Privacy Policy
        </Link>{" "}
        |{" "}
        <Link to="/terms" className="hover:text-gray-700">
          Terms of Service
        </Link>
      </div>
    </footer>
  );
}
