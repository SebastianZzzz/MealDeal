# Food Support (D)

`/support` lists four curated Vancouver/UBC services, with category and text
filters, address, hours, access information, official source URL, and verified
date. Each service was checked against its linked official page on November 7,
2026. The AMS November 9 closure is retained in its hours notice. The UBC Food
Hub Market uses the current Student Services service page rather than older
articles with different hours. Gathering Place and Evelyne Saller are paid
cafeterias, not free meal programs.

A prominent check-before-you-go notice explains that this is a curated list, not
live availability. No sign-in, location permission, or image storage is needed.
Update `resources.ts` only after checking each official source again; update its
verified date at the same time. No real-time search is included in this version.

`GET /api/resources?q=&type=` serves the same curated collection and notice,
without sign-in or a database. Invalid category or overlong search values
return 400. The page continues to use bundled data so it works while shared
storage is unavailable.
