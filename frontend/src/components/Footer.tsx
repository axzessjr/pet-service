export function Footer() {
    const currentYear = new Date().getFullYear();

    return (
        <div className="border-t h-[100px] mt-10 pt-5">
            Copyright {currentYear} All rights reserved by
            <span className="text-green-700 ml-1 font-bold">SigSven Team</span>

        </div>
    )
}