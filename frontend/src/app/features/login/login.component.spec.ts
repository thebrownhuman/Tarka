import { HttpErrorResponse } from '@angular/common/http';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { of, throwError } from 'rxjs';
import { LoginComponent } from './login.component';
import { AuthService } from '../../core/services/auth.service';

describe('LoginComponent', () => {
  let fixture: ComponentFixture<LoginComponent>;
  let component: LoginComponent;
  let authServiceMock: { login: jest.Mock };
  let router: Router;

  beforeEach(async () => {
    authServiceMock = { login: jest.fn() };

    await TestBed.configureTestingModule({
      imports: [LoginComponent],
      providers: [provideRouter([]), { provide: AuthService, useValue: authServiceMock }],
    }).compileComponents();

    fixture = TestBed.createComponent(LoginComponent);
    component = fixture.componentInstance;
    router = TestBed.inject(Router);
    jest.spyOn(router, 'navigate').mockResolvedValue(true);
    fixture.detectChanges();
  });

  it('renders the login form', () => {
    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.querySelector('input#loginId')).toBeTruthy();
    expect(compiled.querySelector('input#password')).toBeTruthy();
    expect(compiled.querySelector('button[type="submit"]')).toBeTruthy();
  });

  it('does not submit while the form is invalid', () => {
    component.submit();
    expect(authServiceMock.login).not.toHaveBeenCalled();
  });

  it('navigates to / on successful login', () => {
    authServiceMock.login.mockReturnValue(
      of({ accessToken: 'a', refreshToken: 'b', role: 'candidate', displayName: 'X', mustChangePassword: false }),
    );
    component.form.setValue({ loginId: 'candidate001', password: 'correct' });

    component.submit();

    expect(authServiceMock.login).toHaveBeenCalledWith('candidate001', 'correct');
    expect(router.navigate).toHaveBeenCalledWith(['/']);
  });

  it('shows a generic error message on invalid credentials (401)', () => {
    authServiceMock.login.mockReturnValue(
      throwError(() => new HttpErrorResponse({ status: 401, error: { error: { code: 'INVALID_CREDENTIALS', message: 'Invalid login ID or password.' } } })),
    );
    component.form.setValue({ loginId: 'candidate001', password: 'wrong' });

    component.submit();

    expect(component.errorMessage()).toBe('Invalid login ID or password.');
  });

  it('shows a rate-limit specific message on 429', () => {
    authServiceMock.login.mockReturnValue(throwError(() => new HttpErrorResponse({ status: 429 })));
    component.form.setValue({ loginId: 'candidate001', password: 'wrong' });

    component.submit();

    expect(component.errorMessage()).toContain('Too many login attempts');
  });
});
