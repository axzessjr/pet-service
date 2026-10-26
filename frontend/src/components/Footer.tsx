export function Footer() {
    const currentYear = new Date().getFullYear();

    return (
        <footer className="mt-10 border-t border-gray-200 py-6 text-sm text-gray-600">
            Copyright {currentYear} All rights reserved by
            <span className="ml-1 font-bold text-teal-800">SigSven Team</span>
        </footer>
    )
}
