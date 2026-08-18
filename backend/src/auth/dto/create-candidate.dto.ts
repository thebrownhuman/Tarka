import { IsNotEmpty, IsString, Matches } from 'class-validator';

export class CreateCandidateDto {
  @IsString()
  @IsNotEmpty({ message: 'login_id is required' })
  @Matches(/^[a-zA-Z0-9._-]+$/, { message: 'login_id may only contain letters, numbers, dots, underscores, and hyphens' })
  login_id!: string;

  @IsString()
  @IsNotEmpty({ message: 'display_name is required' })
  display_name!: string;
}
