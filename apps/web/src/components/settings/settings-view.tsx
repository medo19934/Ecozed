'use client';

import { FeatureToggle, UpdateBranchSchema, type BranchDto } from '@latif/shared';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Crosshair, FlaskConical, ImageUp, MapPin, Trash2, TriangleAlert } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';
import { PageHeader } from '@/components/layout/page-header';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Confirm } from '@/components/ui/confirm';
import { FormField, fieldAria } from '@/components/ui/form-field';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { AdminsPanel } from './admins-panel';
import { UsersPanel } from './users-panel';
import { api, fileUrl } from '@/lib/api-client';
import { isBranchAdmin } from '@/lib/use-can';
import { useErrorMessage } from '@/lib/use-error-message';
import { useFieldErrors } from '@/lib/use-field-errors';
import { SESSION_KEY, useSession } from '@/lib/use-session';

export const BRANCH_KEY = ['branch'] as const;

type Form = {
  name: string;
  nameEn: string;
  phone: string;
  email: string;
  city: string;
  address: string;
  latitude: string;
  longitude: string;
  geofenceRadiusM: string;
  useHijri: boolean;
};

const toForm = (b: BranchDto): Form => ({
  name: b.name,
  nameEn: b.nameEn ?? '',
  phone: b.phone ?? '',
  email: b.email ?? '',
  city: b.city ?? '',
  address: b.address ?? '',
  latitude: b.latitude?.toString() ?? '',
  longitude: b.longitude?.toString() ?? '',
  geofenceRadiusM: String(b.geofenceRadiusM),
  useHijri: b.useHijri,
});

function ProfileTab({ branch }: { branch: BranchDto }) {
  const t = useTranslations('settings');
  const tc = useTranslations('common');
  const qc = useQueryClient();
  const errorMessage = useErrorMessage();
  const { errors, validate } = useFieldErrors();
  const [form, setForm] = useState<Form>(() => toForm(branch));
  const logoInput = useRef<HTMLInputElement>(null);
  useEffect(() => setForm(toForm(branch)), [branch]);

  const set = <K extends keyof Form>(k: K, v: Form[K]) => setForm((f) => ({ ...f, [k]: v }));
  const onSaved = (b: BranchDto) => {
    qc.setQueryData(BRANCH_KEY, b);
    void qc.invalidateQueries({ queryKey: SESSION_KEY });
  };

  const save = useMutation({
    mutationFn: (body: unknown) => api.patch<BranchDto>('/branches/current', body),
    onSuccess: (b) => {
      onSaved(b);
      toast.success(tc('saved'));
    },
    onError: (e) => toast.error(errorMessage(e)),
  });
  const logo = useMutation({
    mutationFn: (file: File | null) =>
      file
        ? api.upload<BranchDto>('/branches/current/logo', file)
        : api.delete<BranchDto>('/branches/current/logo'),
    onSuccess: (b) => {
      onSaved(b);
      toast.success(tc('saved'));
    },
    onError: (e) => toast.error(errorMessage(e)),
  });

  const num = (v: string) => (v.trim() === '' ? null : Number(v));
  const submit = () => {
    const parsed = validate(UpdateBranchSchema, {
      name: form.name,
      nameEn: form.nameEn,
      phone: form.phone,
      email: form.email,
      city: form.city,
      address: form.address,
      latitude: num(form.latitude),
      longitude: num(form.longitude),
      geofenceRadiusM: Number(form.geofenceRadiusM) || 150,
      useHijri: form.useHijri,
    });
    if (parsed) save.mutate(parsed);
  };

  const locate = () =>
    navigator.geolocation.getCurrentPosition(
      (p) => {
        set('latitude', p.coords.latitude.toFixed(6));
        set('longitude', p.coords.longitude.toFixed(6));
      },
      () => toast.error(t('locationDenied')),
      { enableHighAccuracy: true, timeout: 10000 },
    );

  const lat = num(form.latitude);
  const lng = num(form.longitude);
  const hasPin = lat != null && lng != null && !Number.isNaN(lat) && !Number.isNaN(lng);
  const text = (
    k: 'name' | 'nameEn' | 'phone' | 'email' | 'city' | 'address',
    label: string,
    extra?: object,
  ) => (
    <FormField id={`b-${k}`} label={label} error={errors[k]}>
      <Input
        {...fieldAria(`b-${k}`, errors[k])}
        value={form[k]}
        onChange={(e) => set(k, e.target.value)}
        {...extra}
      />
    </FormField>
  );

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_340px]">
      <Card>
        <CardContent className="grid gap-5 sm:grid-cols-2">
          {text('name', t('nameAr'))}
          {text('nameEn', t('nameEn'), { dir: 'ltr' })}
          {text('phone', t('phone'), {
            dir: 'ltr',
            placeholder: '+9665XXXXXXXX',
            inputMode: 'tel',
          })}
          {text('email', t('email'), { dir: 'ltr', type: 'email' })}
          {text('city', t('city'))}
          {text('address', t('address'))}
          <label className="flex items-center gap-3 text-sm sm:col-span-2">
            <Switch
              checked={form.useHijri}
              onCheckedChange={(v) => set('useHijri', v)}
              aria-label={t('useHijri')}
            />
            {t('useHijri')}
          </label>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t('logo')}</CardTitle>
          <CardDescription>{t('logoHint')}</CardDescription>
        </CardHeader>
        <CardContent className="flex items-center gap-4">
          <div className="flex size-20 items-center justify-center overflow-hidden rounded-2xl border bg-muted">
            {branch.hasLogo ? (
              <img
                src={fileUrl('/branches/current/logo', branch.updatedAt)}
                alt={t('logo')}
                className="size-full object-contain"
              />
            ) : (
              <ImageUp className="size-7 text-muted-foreground" aria-hidden />
            )}
          </div>
          <div className="grid gap-2">
            <input
              ref={logoInput}
              type="file"
              accept="image/png,image/jpeg,image/webp"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) logo.mutate(f);
                e.target.value = '';
              }}
            />
            <Button
              size="sm"
              variant="outline"
              disabled={logo.isPending}
              onClick={() => logoInput.current?.click()}
            >
              <ImageUp /> {t('uploadLogo')}
            </Button>
            {branch.hasLogo && (
              <Button
                size="sm"
                variant="ghost"
                disabled={logo.isPending}
                onClick={() => logo.mutate(null)}
              >
                <Trash2 /> {t('removeLogo')}
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      <Card className="lg:col-span-2">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <MapPin className="size-5 text-primary" aria-hidden /> {t('location')}
          </CardTitle>
        </CardHeader>
        <CardContent className="grid gap-5 lg:grid-cols-[1fr_1.2fr]">
          <div className="grid content-start gap-4">
            <p role="note" className="flex gap-3 rounded-2xl bg-warning/12 p-4 text-sm">
              <TriangleAlert className="size-5 shrink-0 text-warning" aria-hidden />
              {t('geofenceWarning')}
            </p>
            <div className="grid grid-cols-2 gap-3">
              <FormField id="b-lat" label={t('latitude')} error={errors.latitude}>
                <Input
                  id="b-lat"
                  dir="ltr"
                  inputMode="decimal"
                  value={form.latitude}
                  onChange={(e) => set('latitude', e.target.value)}
                />
              </FormField>
              <FormField id="b-lng" label={t('longitude')} error={errors.longitude}>
                <Input
                  id="b-lng"
                  dir="ltr"
                  inputMode="decimal"
                  value={form.longitude}
                  onChange={(e) => set('longitude', e.target.value)}
                />
              </FormField>
            </div>
            <Button variant="outline" onClick={locate} className="justify-self-start">
              <Crosshair /> {t('useMyLocation')}
            </Button>
            <FormField id="b-radius" label={t('radius')} error={errors.geofenceRadiusM}>
              <Input
                id="b-radius"
                type="number"
                min={25}
                max={5000}
                dir="ltr"
                value={form.geofenceRadiusM}
                onChange={(e) => set('geofenceRadiusM', e.target.value)}
              />
            </FormField>
          </div>
          <div className="min-h-64 overflow-hidden rounded-2xl border bg-muted">
            {hasPin ? (
              <iframe
                title={t('location')}
                className="size-full min-h-64"
                loading="lazy"
                src={`https://maps.google.com/maps?q=${lat},${lng}&z=16&output=embed`}
              />
            ) : (
              <div className="flex size-full min-h-64 items-center justify-center text-sm text-muted-foreground">
                {t('noLocation')}
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      <div className="flex justify-end lg:col-span-2">
        <Button size="lg" onClick={submit} disabled={save.isPending}>
          {tc('save')}
        </Button>
      </div>
    </div>
  );
}

function FeaturesTab({ branch }: { branch: BranchDto }) {
  const t = useTranslations('settings');
  const tc = useTranslations('common');
  const qc = useQueryClient();
  const errorMessage = useErrorMessage();
  const toggle = useMutation({
    mutationFn: (f: { key: string; enabled: boolean }) =>
      api.put<BranchDto>('/branches/current/features', { features: [f] }),
    onSuccess: (b) => {
      qc.setQueryData(BRANCH_KEY, b);
      void qc.invalidateQueries({ queryKey: SESSION_KEY });
      toast.success(tc('saved'));
    },
    onError: (e) => toast.error(errorMessage(e)),
  });
  return (
    <Card>
      <CardHeader>
        <CardDescription>{t('featuresHint')}</CardDescription>
      </CardHeader>
      <CardContent className="grid gap-1">
        {Object.values(FeatureToggle).map((key) => (
          <label
            key={key}
            className="flex min-h-14 items-center justify-between gap-4 rounded-xl px-2 hover:bg-muted/60"
          >
            <span className="text-sm font-medium">{t(`features.${key}`)}</span>
            <Switch
              checked={Boolean(branch.features[key])}
              disabled={toggle.isPending}
              onCheckedChange={(enabled) => toggle.mutate({ key, enabled })}
              aria-label={t(`features.${key}`)}
            />
          </label>
        ))}
      </CardContent>
    </Card>
  );
}

function TestDataTab() {
  const t = useTranslations('settings');
  const errorMessage = useErrorMessage();
  const qc = useQueryClient();
  const status = useQuery({
    queryKey: ['test-data'],
    queryFn: () => api.get<{ classes: number; children: number; staff: number }>('/test-data'),
  });
  const after = (s: { classes: number; children: number; staff: number }) => {
    qc.setQueryData(['test-data'], s);
    void qc.invalidateQueries({
      predicate: (q) => ['children', 'classes', 'staff'].includes(String(q.queryKey[0])),
    });
  };
  const create = useMutation({
    mutationFn: () => api.post<typeof status.data>('/test-data'),
    onSuccess: (s) => s && after(s),
    onError: (e) => toast.error(errorMessage(e)),
  });
  const clear = useMutation({
    mutationFn: () => api.delete<typeof status.data>('/test-data'),
    onSuccess: (s) => s && after(s),
    onError: (e) => toast.error(errorMessage(e)),
  });
  const s = status.data;
  return (
    <Card className="border-2 border-dashed border-warning/60">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <FlaskConical className="size-5 text-warning" aria-hidden /> {t('testTitle')}
        </CardTitle>
        <CardDescription>{t('testBody')}</CardDescription>
      </CardHeader>
      <CardContent className="grid gap-4">
        {s ? <p className="text-sm">{t('testCounts', s)}</p> : <Skeleton className="h-5 w-64" />}
        <div className="flex flex-wrap gap-2">
          <Button
            variant="outline"
            className="border-warning/60"
            disabled={create.isPending}
            onClick={() => create.mutate()}
          >
            <FlaskConical /> {t('testCreate')}
          </Button>
          <Confirm
            title={t('testConfirm')}
            confirmLabel={t('testClear')}
            destructive
            onConfirm={() => clear.mutateAsync()}
          >
            <Button variant="ghost" disabled={!s || s.children + s.classes + s.staff === 0}>
              <Trash2 /> {t('testClear')}
            </Button>
          </Confirm>
        </div>
      </CardContent>
    </Card>
  );
}

export function SettingsView() {
  const t = useTranslations('settings');
  const tn = useTranslations('nav');
  const { data: user } = useSession();
  const branch = useQuery({
    queryKey: BRANCH_KEY,
    queryFn: () => api.get<BranchDto>('/branches/current'),
  });

  return (
    <>
      <PageHeader
        title={t('title')}
        crumbs={[{ label: tn('dashboard'), href: '/dashboard' }, { label: t('title') }]}
        crumbsLabel={tn('breadcrumb')}
      />
      {!branch.data ? (
        <Skeleton className="h-96 w-full" />
      ) : (
        <Tabs defaultValue="profile" className="grid gap-5">
          <TabsList className="max-w-full justify-self-start overflow-x-auto">
            <TabsTrigger value="profile">{t('profileTab')}</TabsTrigger>
            <TabsTrigger value="features">{t('featuresTab')}</TabsTrigger>
            {isBranchAdmin(user) && <TabsTrigger value="users">{t('usersTab')}</TabsTrigger>}
            {isBranchAdmin(user) && <TabsTrigger value="test">{t('testTab')}</TabsTrigger>}
            {user?.isSuperAdmin && <TabsTrigger value="admins">{t('adminsTab')}</TabsTrigger>}
          </TabsList>
          <TabsContent value="profile">
            <ProfileTab branch={branch.data} />
          </TabsContent>
          <TabsContent value="features">
            <FeaturesTab branch={branch.data} />
          </TabsContent>
          {isBranchAdmin(user) && (
            <TabsContent value="users">
              <UsersPanel />
            </TabsContent>
          )}
          {isBranchAdmin(user) && (
            <TabsContent value="test">
              <TestDataTab />
            </TabsContent>
          )}
          {user?.isSuperAdmin && (
            <TabsContent value="admins">
              <AdminsPanel />
            </TabsContent>
          )}
        </Tabs>
      )}
    </>
  );
}
