# unfast-core

#### LIMITATION
  * Because `tsc` doesn't resolve `alias` and we need this cmd to generate **type-checking**. It will be unfriendly to use alias when we need the compiled output can be directly used by others... So we don't use `alias` any more.
    * See https://github.com/microsoft/TypeScript/issues/26722