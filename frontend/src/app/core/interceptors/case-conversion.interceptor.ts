import { HttpEvent, HttpHandlerFn, HttpRequest, HttpResponse } from '@angular/common/http';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { keysToCamel, keysToSnake } from '../utils/case-convert';

/**
 * Backend wire format is snake_case (project convention); TypeScript code
 * stays camelCase. This interceptor converts at the HTTP boundary so no
 * feature code ever has to think about case.
 */
export function caseConversionInterceptor(
  req: HttpRequest<unknown>,
  next: HttpHandlerFn,
): Observable<HttpEvent<unknown>> {
  const convertedReq = req.clone({
    body: req.body ? keysToSnake(req.body) : req.body,
  });

  return next(convertedReq).pipe(
    map((event) => {
      if (event instanceof HttpResponse && event.body) {
        return event.clone({ body: keysToCamel(event.body) });
      }
      return event;
    }),
  );
}
