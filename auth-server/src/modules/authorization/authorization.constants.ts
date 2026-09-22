// How long a person has between being sent to the login page and signing in.
export const AUTHORIZATION_REQUEST_TTL_SECONDS = 10 * 60;

// RFC 6749 §4.1.2 recommends at most ten minutes; production servers use well
// under one. Two minutes leaves room to copy a code out of the address bar by
// hand, which is how this repo's walkthrough exchanges one from Postman.
export const AUTHORIZATION_CODE_TTL_SECONDS = 2 * 60;

// Both the interaction id and the code are bearer values: whoever holds one can
// use it. 256 bits is what keeps them unguessable.
export const RANDOM_VALUE_BYTES = 32;
