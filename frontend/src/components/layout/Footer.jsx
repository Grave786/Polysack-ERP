import React from "react";
import { Heart } from "lucide-react";

const Footer = () => {
    const currentYear = new Date().getFullYear();

    return (
        <footer className="w-full shrink-0 border-t border-slate-200 bg-white py-3 px-6 text-xs text-slate-500 transition-colors">
            <div className="w-full flex flex-col sm:flex-row items-center justify-center gap-2 text-center sm:text-left">
                <span>© {currentYear} Polysack ERP. All Rights Reserved.</span>
                <span className="hidden sm:inline text-slate-300">•</span>
                <div className="flex items-center gap-1">
                    <span>Designed & Developed by </span>
                    <Heart className="h-3.5 w-3.5 fill-red-500 text-red-500 inline-block" />
                    <a
                        href="https://requinsolutions.com"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-slate-700 underline underline-offset-2 hover:text-amber-600 font-medium transition-colors"
                    >
                        Requin Solutions Pvt. Ltd
                    </a>
                </div>
            </div>
        </footer>
    );
};

export default Footer;