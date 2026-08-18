import { IsNotEmpty, IsString } from 'class-validator';

export class LoginDto {
  @IsString()
  @IsNotEmpty({ message: 'login_id is required' })
  login_id!: string;

  @IsString()
  @IsNotEmpty({ message: 'password is required' })
  password!: string;
}
