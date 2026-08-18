import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { AvailableTestsResponse } from '../models/test.model';
import { QuestionResponse } from '../models/question.model';
import {
  AdvanceNextResponse,
  AttemptDetailResponse,
  AttemptHistoryListResponse,
  ExtensionRequestResponse,
  StartAttemptResponse,
  SubmitTestResponse,
} from '../models/test-attempt.model';

const BASE_URL = `${environment.apiBaseUrl}/test-attempts`;
const EXTENSIONS_URL = `${environment.apiBaseUrl}/extension-requests`;

@Injectable({ providedIn: 'root' })
export class TestAttemptService {
  constructor(private readonly http: HttpClient) {}

  listAvailableTests(): Observable<AvailableTestsResponse> {
    return this.http.get<AvailableTestsResponse>(`${BASE_URL}/available-tests`);
  }

  startAttempt(testId: string): Observable<StartAttemptResponse> {
    return this.http.post<StartAttemptResponse>(`${BASE_URL}/start`, { testId });
  }

  // attempt_id is a raw query param (not converted by the interceptor since
  // it's not a request body) - pass the exact backend param name here.
  getCurrentQuestion(attemptId: string): Observable<QuestionResponse> {
    const params = new HttpParams().set('attempt_id', attemptId);
    return this.http.get<QuestionResponse>(`${BASE_URL}/current-question`, { params });
  }

  getQuestionAt(attemptId: string, position: number): Observable<QuestionResponse> {
    return this.http.post<QuestionResponse>(`${BASE_URL}/question`, { attemptId, position });
  }

  submitAnswer(attemptId: string, questionId: string, selectedOptionIds: string[]): Observable<{ success: boolean }> {
    return this.http.post<{ success: boolean }>(`${BASE_URL}/answer`, { attemptId, questionId, selectedOptionIds });
  }

  advanceNext(attemptId: string): Observable<AdvanceNextResponse> {
    return this.http.post<AdvanceNextResponse>(`${BASE_URL}/next`, { attemptId });
  }

  submitTest(attemptId: string): Observable<SubmitTestResponse> {
    return this.http.post<SubmitTestResponse>(`${BASE_URL}/submit`, { attemptId });
  }

  requestExtension(attemptId: string, requestedSeconds?: number): Observable<ExtensionRequestResponse> {
    return this.http.post<ExtensionRequestResponse>(`${EXTENSIONS_URL}/request`, {
      attemptId,
      requestedSeconds,
    });
  }

  listHistory(offset: number, limit: number): Observable<AttemptHistoryListResponse> {
    return this.http.post<AttemptHistoryListResponse>(`${BASE_URL}/history/list`, { offset, limit });
  }

  getHistoryDetail(attemptId: string): Observable<AttemptDetailResponse> {
    const params = new HttpParams().set('attempt_id', attemptId);
    return this.http.get<AttemptDetailResponse>(`${BASE_URL}/history/detail`, { params });
  }
}
