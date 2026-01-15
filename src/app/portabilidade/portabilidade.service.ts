import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { firstValueFrom } from 'rxjs';

@Injectable({ providedIn: 'root' })
export class PortabilidadeService {
  // Endpoints seguros do servidor (token não fica exposto no cliente)
  private readonly apiBase = '/api';

  constructor(private readonly http: HttpClient) {}

  async listarDeclaracao(chaveUnica: string): Promise<string | null> {
    const url = `${this.apiBase}/listar-declaracoes`;
    const body = { chaveUnica };

    type DeclResponse = { tipoDeclaracoes: Array<{ declaracoes: Array<{ idDeclaracao: string }> }> };

    const resp = await firstValueFrom(
      this.http.post<DeclResponse>(url, body)
    );
    const tipo = resp?.tipoDeclaracoes?.[0];
    const decl = tipo?.declaracoes?.[0];
    return decl?.idDeclaracao ?? null;
  }

  async obterDeclaracaoPdf(chaveUnica: string, idDeclaracao: string): Promise<string | null> {
    const url = `${this.apiBase}/declaracao-pdf`;
    const body = { chaveUnica, idDeclaracao };

    type PdfResponse = { base64?: string };
    const resp = await firstValueFrom(
      this.http.post<PdfResponse>(url, body)
    );
    return resp?.base64 ?? null;
  }
}
