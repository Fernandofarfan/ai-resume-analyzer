import { useEffect } from "react";
import { useLocation, useNavigate } from "react-router";

export const meta = () => [
    { title: "Resumind | Auth" },
    { name: "description", content: "Log into your account" },
];

const Auth = () => {
    const location = useLocation();
    const searchParams = new URLSearchParams(location.search);
    const next = searchParams.get("next") || "/";
    const navigate = useNavigate();

    useEffect(() => {
        navigate(next);
    }, [next, navigate]);

    return (
        <main className="bg-[url('/images/bg-auth.svg')] bg-cover min-h-screen flex items-center justify-center">
            <div className="gradient-border shadow-lg">
                <section className="flex flex-col gap-8 bg-white rounded-2xl p-10">
                    <div className="flex flex-col items-center gap-2 text-center">
                        <h1>Welcome</h1>
                        <h2>Local mode active</h2>
                    </div>
                    <div>
                        <button className="auth-button" onClick={() => navigate(next)}>
                            <p>Enter App</p>
                        </button>
                    </div>
                </section>
            </div>
        </main>
    );
};

export default Auth;
