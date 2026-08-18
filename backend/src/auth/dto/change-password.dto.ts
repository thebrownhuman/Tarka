import { IsNotEmpty, IsString, MinLength } from 'class-validator';

export class ChangePasswordDto {
  @IsString()
  @IsNotEmpty({ message: 'current_password is required' })
  current_password!: string;

  @IsString()
  @IsNotEmpty({ message: 'new_password is required' })
  @MinLength(8, { message: 'new_password must be at least 8 characters' })
  new_password!: string;
}
