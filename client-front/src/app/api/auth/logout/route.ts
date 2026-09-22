import { NextResponse, type NextRequest } from "next/server";

// POST /api/auth/logout — ends this app's session only. The provider's refresh
// token is not revoked (there is no revocation endpoint yet); it just expires.
export const POST = (request: NextRequest): NextResponse => {
  // 303 turns the form's POST into a GET of the home page.
  const response = NextResponse.redirect(new URL("/", request.nextUrl.origin), 303);
  response.cookies.delete("session");

  return response;
};
