import Link from "next/link";

export function PublicNav() {
  return (
    <nav className="bg-gray-900 border-b border-gray-800 sticky top-0 z-40">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex items-center gap-6 h-14">
        <Link href="/" className="font-bold text-brand-500 text-lg tracking-tight">
          KawKaw
        </Link>
        <Link href="/species" className="text-sm text-gray-400 hover:text-white transition-colors">
          Species
        </Link>
        <Link href="/trips" className="text-sm text-gray-400 hover:text-white transition-colors">
          Trips
        </Link>
        <Link href="/albums" className="text-sm text-gray-400 hover:text-white transition-colors">
          Albums
        </Link>
        <Link href="/locations" className="text-sm text-gray-400 hover:text-white transition-colors">
          Locations
        </Link>
        <div className="ml-auto">
          <Link href="/admin" className="text-xs text-gray-600 hover:text-gray-400 transition-colors">
            Admin
          </Link>
        </div>
      </div>
    </nav>
  );
}
