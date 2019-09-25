```c
#include <sentry.h>

sentry_value_t user = sentry_value_new_object();
sentry_value_set_by_key(user, "email", sentry_value_new_string("{{ page.example_user_email }}"));
sentry_set_user(user);
```