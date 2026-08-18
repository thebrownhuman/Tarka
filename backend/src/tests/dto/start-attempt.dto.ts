import { IsNotEmpty, IsString } from 'class-validator';

export class StartAttemptDto {
  @IsString()
  @IsNotEmpty({ message: 'test_id is required' })
  test_id!: string;
}
