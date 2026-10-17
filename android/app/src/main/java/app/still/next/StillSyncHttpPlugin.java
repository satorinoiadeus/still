package app.still.next;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.nio.charset.StandardCharsets;
import java.util.Arrays;
import java.util.Iterator;
import java.util.concurrent.TimeUnit;
import okhttp3.Call;
import okhttp3.Callback;
import okhttp3.MediaType;
import okhttp3.OkHttpClient;
import okhttp3.Request;
import okhttp3.RequestBody;
import okhttp3.Response;

/** WebDAV needs arbitrary HTTP verbs that Android HttpURLConnection rejects. */
@CapacitorPlugin(name = "StillSyncHttp")
public class StillSyncHttpPlugin extends Plugin {
    private static final int LIMIT = 50_000_000;
    private final OkHttpClient client = new OkHttpClient.Builder()
        .connectTimeout(30, TimeUnit.SECONDS).readTimeout(30, TimeUnit.SECONDS)
        .callTimeout(45, TimeUnit.SECONDS).followRedirects(false).followSslRedirects(false).build();

    public static Request buildRequest(JSObject input) throws Exception {
        String method = input.getString("method", "GET");
        if (!Arrays.asList("GET", "PUT", "DELETE", "PROPFIND", "MKCOL", "POST").contains(method)) throw new IOException("Unsupported sync method");
        Request.Builder builder = new Request.Builder().url(input.getString("url"));
        if (!builder.build().url().isHttps() || !builder.build().url().username().isEmpty() || !builder.build().url().password().isEmpty()) throw new IOException("Sync requires HTTPS without embedded credentials");
        JSObject headers = input.getJSObject("headers", new JSObject());
        Iterator<String> names = headers.keys();
        while (names.hasNext()) { String name = names.next(); builder.header(name, headers.getString(name)); }
        String content = input.getString("body", null);
        RequestBody body = null;
        if (content != null) {
            byte[] bytes = content.getBytes(StandardCharsets.UTF_8);
            if (bytes.length > LIMIT) throw new IOException("Sync upload exceeds 50 MB");
            body = RequestBody.create(bytes, MediaType.parse(headers.getString("Content-Type", "application/octet-stream")));
        } else if (method.equals("PUT") || method.equals("POST")) body = RequestBody.create(new byte[0], null);
        return builder.method(method, body).build();
    }

    @PluginMethod
    public void request(PluginCall call) {
        try {
            Request request = buildRequest(call.getData());
            client.newCall(request).enqueue(new Callback() {
                @Override public void onFailure(Call httpCall, IOException error) { call.reject("Sync network request failed", error); }
                @Override public void onResponse(Call httpCall, Response response) {
                    try (Response closeable = response; ByteArrayOutputStream output = new ByteArrayOutputStream()) {
                        if (response.body() != null) {
                            if (response.body().contentLength() > LIMIT) throw new IOException("Sync response exceeds 50 MB");
                            try (InputStream input = response.body().byteStream()) {
                                byte[] chunk = new byte[8192]; int read; int total = 0;
                                while ((read = input.read(chunk)) != -1) { total += read; if (total > LIMIT) throw new IOException("Sync response exceeds 50 MB"); output.write(chunk, 0, read); }
                            }
                        }
                        JSObject result = new JSObject(); result.put("status", response.code()); result.put("body", output.toString(StandardCharsets.UTF_8.name())); call.resolve(result);
                    } catch (Exception error) { call.reject("Sync response failed", error); }
                }
            });
        } catch (Exception error) { call.reject("Invalid sync request", error); }
    }
    @Override protected void handleOnDestroy() { client.dispatcher().cancelAll(); super.handleOnDestroy(); }
}
