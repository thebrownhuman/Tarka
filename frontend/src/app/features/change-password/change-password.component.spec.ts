import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { of, throwError } from 'rxjs';
import { HttpErrorResponse } from '@angular/common/http';
import { ChangePasswordComponent } from './change-password.component';
import { AuthService } from '../../core/services/auth.service';

describe('ChangePasswordComponent', () => {
  let fixture: ComponentFixture<ChangePasswordComponent>;
  let component: ChangePasswordComponent;
  let authServiceMock: { changePassword: jest.Mock };
  let router: Router;

  beforeEach(async () => {
    authServiceMock = { changePassword: jest.fn() };

    await TestBed.configureTestingModule({
      imports: [ChangePasswordComponent],
      providers: [provideRouter([]), { provide: AuthService, useValue: authServiceMock }],
    }).compileComponents();

    fixture = TestBed.createComponent(ChangePasswordComponent);
    component = fixture.componentInstance;
    router = TestBed.inject(Router);
    jest.spyOn(router, 'navigate').mockResolvedValue(true);
    fixture.detectChanges();
  });

  it('renders the change password form', () => {
    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.querySelector('input#currentPassword')).toBeTruthy();
    expect(compiled.querySelector('input#newPassword')).toBeTruthy();
    expect(compiled.querySelector('input#confirmPassword')).toBeTruthy();
  });

  it('flags a mismatch between new password and confirmation', () => {
    component.form.setValue({
      currentPassword: 'old-one-time-pw',
      newPassword: 'NewPassword123',
      confirmPassword: 'DoesNotMatch123',
    });
    expect(component.form.errors?.['passwordsMismatch']).toBe(true);
    expect(authServiceMock.changePassword).not.toHaveBeenCalled();
  });

  it('redirects to / once the flag clears on success', () => {
    authServiceMock.changePassword.mockReturnValue(of({ success: true }));
    component.form.setValue({
      currentPassword: 'old-one-time-pw',
      newPassword: 'NewPassword123',
      confirmPassword: 'NewPassword123',
    });

    component.submit();

    expect(authServiceMock.changePassword).toHaveBeenCalledWith('old-one-time-pw', 'NewPassword123');
    expect(router.navigate).toHaveBeenCalledWith(['/']);
  });

  it('shows the backend error message when the current password is wrong', () => {
    authServiceMock.changePassword.mockReturnValue(
      throwError(() => new HttpErrorResponse({ status: 400, error: { error: { code: 'WRONG_CURRENT_PASSWORD', message: 'Current password is incorrect.' } } })),
    );
    component.form.setValue({
      currentPassword: 'wrong-one-time-pw',
      newPassword: 'NewPassword123',
      confirmPassword: 'NewPassword123',
    });

    component.submit();

    expect(component.errorMessage()).toBe('Current password is incorrect.');
  });
});
