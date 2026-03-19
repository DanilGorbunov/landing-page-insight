import { useLocation, Link } from "react-router-dom";
import { useEffect } from "react";
import { TOUCH_TARGET_CLASS } from "@/lib/constants";

const NotFound = () => {
  const location = useLocation();

  useEffect(() => {
    console.error("404 Error: User attempted to access non-existent route:", location.pathname);
  }, [location.pathname]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="text-center max-w-md">
        <h1 className="mb-2 text-5xl sm:text-6xl font-bold text-foreground tabular-nums">404</h1>
        <p className="mb-6 text-base sm:text-lg text-muted-foreground">Page not found</p>
        <Link
          to="/"
          className={`${TOUCH_TARGET_CLASS} px-6 py-3 rounded-md bg-primary text-primary-foreground text-sm font-medium hover:brightness-110 transition-colors touch-manipulation`}
        >
          Back to Home
        </Link>
      </div>
    </div>
  );
};

export default NotFound;
