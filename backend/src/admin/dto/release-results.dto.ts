import { IsBoolean, IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class ReleaseResultsDto {
  @IsString()
  @IsNotEmpty({ message: 'attempt_id is required' })
  attempt_id!: string;

  // Defaults to false (results only, no answer key) when omitted - the
  // stricter, less-revealing choice should never be the accidental default.
  @IsOptional()
  @IsBoolean()
  include_answers?: boolean;
}
