package app.still.next;

import androidx.test.ext.junit.runners.AndroidJUnit4;
import com.getcapacitor.JSObject;
import okhttp3.Request;
import org.junit.Test;
import org.junit.runner.RunWith;
import static org.junit.Assert.*;

@RunWith(AndroidJUnit4.class)
public class SyncHttpInstrumentedTest {
    @Test public void webdavVerbsAndBodiesSurviveNativeRequestBuilder() throws Exception {
        for (String method : new String[] { "PROPFIND", "MKCOL", "PUT", "GET", "DELETE" }) {
            JSObject options = new JSObject(); options.put("url", "https://example.test/Still/"); options.put("method", method);
            JSObject headers = new JSObject(); headers.put("Authorization", "Basic test"); headers.put("Depth", "1"); options.put("headers", headers);
            if (method.equals("PROPFIND")) options.put("body", "<propfind xmlns=\"DAV:\"/>");
            Request request = StillSyncHttpPlugin.buildRequest(options);
            assertEquals(method, request.method()); assertEquals("Basic test", request.header("Authorization"));
            if (method.equals("PROPFIND")) assertNotNull(request.body());
        }
    }
    @Test public void rejectsPlainHttpAndUnrelatedMethods() throws Exception {
        for (String url : new String[] { "http://example.test/Still/", "https://user:password@example.test/" }) {
            JSObject options = new JSObject(); options.put("url", url); options.put("method", "GET");
            try { StillSyncHttpPlugin.buildRequest(options); fail("Insecure request accepted"); } catch (java.io.IOException expected) { assertTrue(expected.getMessage().contains("HTTPS")); }
        }
        JSObject options = new JSObject(); options.put("url", "https://example.test/"); options.put("method", "TRACE");
        try { StillSyncHttpPlugin.buildRequest(options); fail("TRACE accepted"); } catch (java.io.IOException expected) { assertTrue(expected.getMessage().contains("method")); }
    }
}
